// flair-metal-hash: dee13adb
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float uAngle;
    float uFlap;
    float uMirror;
    char _m18_pad[12];
    packed_float3 uTint;
    float uShadow;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_mirror_fold_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _60)
{
    float _229;
    if (_60.uAnimate != 0u)
    {
        _229 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_60.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _229 = _60.uProgress;
    }
    return _229;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _60)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_60.uBackdrop) * _60.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_60.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _60)
{
    float4 _204;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _204 = overBackdrop(param, _60);
    }
    else
    {
        float2 param_1 = fract(uv);
        _204 = float4(testCard(param_1), 1.0);
    }
    return _204;
}

static inline __attribute__((always_inline))
float4 coverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _60)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _60.iResolution[0u] / _60.iResolution[1u];
    float _266;
    if (size.x > 1.0)
    {
        _266 = size.x / size.y;
    }
    else
    {
        _266 = frameAspect;
    }
    float imageAspect = _266;
    float2 _281;
    if (frameAspect > imageAspect)
    {
        _281 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _281 = float2(frameAspect / imageAspect, 1.0);
    }
    float2 scale = _281;
    float2 param = float2(0.5) + ((uv - float2(0.5)) * scale);
    return pictureRGBA(tex, texSmplr, param, _60);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _60, texture2d<float> uTo, sampler uToSmplr, texture2d<float> uFrom, sampler uFromSmplr)
{
    float px = 1.0 / _60.iResolution[1u];
    float aspect = _60.iResolution[0u] * px;
    float2 p = (fragCoord - (float2(_60.iResolution[0], _60.iResolution[1]) * 0.5)) * px;
    float2 dir = float2(cos(radians(_60.uAngle)), sin(radians(_60.uAngle)));
    float span = (0.5 * ((abs(dir.x) * aspect) + abs(dir.y))) + _60.uFlap;
    float t = progress(_60);
    float crease = mix(-span, span, t);
    float x = dot(p, dir) - crease;
    float flapW = (_60.uFlap * smoothstep(0.0, 0.1500000059604644775390625, t)) * smoothstep(1.0, 0.85000002384185791015625, t);
    float4 col;
    if (x < 0.0)
    {
        float2 param = (p / float2(aspect, 1.0)) + float2(0.5);
        col = coverRGBA(uTo, uToSmplr, param, _60);
    }
    else
    {
        if (x < flapW)
        {
            float k = x / flapW;
            float2 back = p - ((dir * 2.0) * x);
            float2 param_1 = (back / float2(aspect, 1.0)) + float2(0.5);
            float4 seen = coverRGBA(uTo, uToSmplr, param_1, _60);
            float2 param_2 = (back / float2(aspect, 1.0)) + float2(0.5);
            float4 paper = coverRGBA(uFrom, uFromSmplr, param_2, _60);
            float3 face = mix(paper.xyz * 0.85000002384185791015625, seen.xyz * float3(_60.uTint), float3(_60.uMirror));
            face *= (0.64999997615814208984375 + (0.449999988079071044921875 * k));
            face += float3((_60.uMirror * 0.300000011920928955078125) * exp(-powr((k - 0.699999988079071044921875) * 6.0, 2.0)));
            col = float4(face, fast::max(seen.w, paper.w));
        }
        else
        {
            float2 param_3 = (p / float2(aspect, 1.0)) + float2(0.5);
            col = coverRGBA(uFrom, uFromSmplr, param_3, _60);
            float4 _496 = col;
            float3 _498 = _496.xyz * (1.0 - (((_60.uShadow * 0.5) * exp((-(x - flapW)) / 0.039999999105930328369140625)) * step(0.001000000047497451305389404296875, flapW)));
            col.x = _498.x;
            col.y = _498.y;
            col.z = _498.z;
        }
    }
    fragColor = col;
}

fragment flair_transition_mirror_fold_frag_out flair_transition_mirror_fold_frag(constant FlairUniforms& _60 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_mirror_fold_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _519;
    if (_60.flair_flipY > 0.5)
    {
        _519 = _60.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _519 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _519);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _60, uTo, uToSmplr, uFrom, uFromSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

