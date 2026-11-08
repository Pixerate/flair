// flair-metal-hash: 479e81a6
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    uint uAnimate;
    float uProgress;
    int uMode;
    float uAngle;
    float uStrength;
    float uPunch;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_whip_pan_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _81)
{
    float _250;
    if (_81.uAnimate != 0u)
    {
        _250 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_81.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _250 = _81.uProgress;
    }
    return _250;
}

static inline __attribute__((always_inline))
float2 coverScale(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _81)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _81.iResolution[0u] / _81.iResolution[1u];
    float _287;
    if (size.x > 1.0)
    {
        _287 = size.x / size.y;
    }
    else
    {
        _287 = frameAspect;
    }
    float imageAspect = _287;
    float2 _301;
    if (frameAspect > imageAspect)
    {
        _301 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _301 = float2(frameAspect / imageAspect, 1.0);
    }
    return _301;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _81)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_81.uBackdrop) * _81.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_81.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _81)
{
    float4 _225;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _225 = overBackdrop(param, _81);
    }
    else
    {
        float2 param_1 = fract(uv);
        _225 = float4(testCard(param_1), 1.0);
    }
    return _225;
}

static inline __attribute__((always_inline))
float4 coverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _81)
{
    float2 param = float2(0.5) + ((uv - float2(0.5)) * coverScale(tex, texSmplr, _81));
    return pictureRGBA(tex, texSmplr, param, _81);
}

static inline __attribute__((always_inline))
float4 folded(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _81)
{
    float2 param = float2(1.0) - abs(float2(1.0) - mod(uv, float2(2.0)));
    return coverRGBA(tex, texSmplr, param, _81);
}

static inline __attribute__((always_inline))
float4 smear(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& dir, thread const float& len, constant FlairUniforms& _81)
{
    float4 sum = float4(0.0);
    for (int i = 0; i < 24; i++)
    {
        float2 param = uv + ((dir * len) * (((float(i) + 0.5) / 24.0) - 0.5));
        sum += folded(tex, texSmplr, param, _81);
    }
    return sum / float4(24.0);
}

static inline __attribute__((always_inline))
float4 zoomSmear(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& len, constant FlairUniforms& _81)
{
    float4 sum = float4(0.0);
    for (int i = 0; i < 24; i++)
    {
        float k = 1.0 - ((len * (float(i) + 0.5)) / 24.0);
        float2 param = float2(0.5) + ((uv - float2(0.5)) * k);
        sum += folded(tex, texSmplr, param, _81);
    }
    return sum / float4(24.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _81, texture2d<float> uTo, sampler uToSmplr, texture2d<float> uFrom, sampler uFromSmplr)
{
    float2 uv = fragCoord / float2(_81.iResolution[0], _81.iResolution[1]);
    float t = progress(_81);
    bool second = t >= 0.5;
    float _425;
    if (second)
    {
        _425 = 2.0 - (2.0 * t);
    }
    else
    {
        _425 = 2.0 * t;
    }
    float u = _425;
    float travel = (u * u) * u;
    float speed = u * u;
    float4 col;
    if (_81.uMode == 0)
    {
        float2 dir = float2(cos(radians(_81.uAngle)), sin(radians(_81.uAngle))) * float2(_81.iResolution[1u] / _81.iResolution[0u], 1.0);
        float2 shift = ((dir * travel) * (0.4000000059604644775390625 + (0.60000002384185791015625 * _81.uStrength))) * (second ? (-1.0) : 1.0);
        float2 p = (float2(0.5) + ((uv - float2(0.5)) / float2(1.0 + (_81.uPunch * speed)))) - shift;
        float len = (_81.uStrength * 0.60000002384185791015625) * speed;
        float4 _510;
        if (second)
        {
            float2 param = p;
            float2 param_1 = dir;
            float param_2 = len;
            _510 = smear(uTo, uToSmplr, param, param_1, param_2, _81);
        }
        else
        {
            float2 param_3 = p;
            float2 param_4 = dir;
            float param_5 = len;
            _510 = smear(uFrom, uFromSmplr, param_3, param_4, param_5, _81);
        }
        col = _510;
    }
    else
    {
        float2 p_1 = float2(0.5) + ((uv - float2(0.5)) / float2((1.0 + ((4.0 * _81.uPunch) * travel)) + ((0.20000000298023223876953125 * _81.uStrength) * travel)));
        float len_1 = (_81.uStrength * 0.5) * speed;
        float4 _560;
        if (second)
        {
            float2 param_6 = p_1;
            float param_7 = len_1;
            _560 = zoomSmear(uTo, uToSmplr, param_6, param_7, _81);
        }
        else
        {
            float2 param_8 = p_1;
            float param_9 = len_1;
            _560 = zoomSmear(uFrom, uFromSmplr, param_8, param_9, _81);
        }
        col = _560;
    }
    float4 _584 = col;
    float3 _586 = _584.xyz * (1.0 + (((0.25 * _81.uStrength) * speed) * speed));
    col.x = _586.x;
    col.y = _586.y;
    col.z = _586.z;
    fragColor = col;
}

fragment flair_transition_whip_pan_frag_out flair_transition_whip_pan_frag(constant FlairUniforms& _81 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_whip_pan_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _607;
    if (_81.flair_flipY > 0.5)
    {
        _607 = _81.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _607 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _607);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _81, uTo, uToSmplr, uFrom, uFromSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

