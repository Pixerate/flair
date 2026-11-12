// flair-metal-hash: 4e405425
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    packed_float3 uColor;
    float uGround;
    float uSize;
    float uOpacity;
    float uSoftness;
    float uCycle;
    float uWalk;
    uint uLeftToRight;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_passing_silhouette_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _71)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_71.uBackdrop) * _71.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_71.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _71)
{
    float4 _215;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _215 = overBackdrop(param, _71);
    }
    else
    {
        float2 param_1 = fract(uv);
        _215 = float4(testCard(param_1), 1.0);
    }
    return _215;
}

static inline __attribute__((always_inline))
float segT(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ba = b - a;
    return fast::clamp(dot(p - a, ba) / fast::max(dot(ba, ba), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
}

static inline __attribute__((always_inline))
float segDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 param = p;
    float2 param_1 = a;
    float2 param_2 = b;
    return length((p - a) - ((b - a) * segT(param, param_1, param_2)));
}

static inline __attribute__((always_inline))
float limb(thread const float2& q, thread const float2& a, thread const float2& b, thread const float& r)
{
    float2 param = q;
    float2 param_1 = a;
    float2 param_2 = b;
    return segDist(param, param_1, param_2) - r;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _71, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_71.iResolution[0], _71.iResolution[1]);
    float aspect = _71.iResolution[0u] / _71.iResolution[1u];
    float2 p = (fragCoord - (float2(_71.iResolution[0], _71.iResolution[1]) * 0.5)) / float2(_71.iResolution[1u]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _71);
    float T = mod(_71.iTime, _71.uCycle);
    float s = T / fast::max(_71.uWalk, 0.100000001490116119384765625);
    float cover = 0.0;
    if (s < 1.0)
    {
        float x = mix(((-0.5) * aspect) - (0.25 * _71.uSize), (0.5 * aspect) + (0.25 * _71.uSize), s);
        if (!(_71.uLeftToRight != 0u))
        {
            x = -x;
        }
        float stride = (T * 3.141590118408203125) * 1.10000002384185791015625;
        float2 q = (p - float2(x, _71.uGround)) / float2(_71.uSize);
        q.y -= (0.01200000010430812835693359375 * abs(sin(stride)));
        if (!(_71.uLeftToRight != 0u))
        {
            q.x = -q.x;
        }
        float swing = 0.319999992847442626953125 * sin(stride);
        float2 hip = float2(0.0, 0.5);
        float2 shoulder = float2(0.0199999995529651641845703125, 0.800000011920928955078125);
        float d = length(q - float2(0.02999999932944774627685546875, 0.89999997615814208984375)) - 0.054999999701976776123046875;
        float2 param_1 = q;
        float2 param_2 = hip;
        float2 param_3 = shoulder;
        float param_4 = 0.04500000178813934326171875;
        d = fast::min(d, limb(param_1, param_2, param_3, param_4));
        float _439;
        for (int k = 0; k < 2; k++)
        {
            if (k == 0)
            {
                _439 = swing;
            }
            else
            {
                _439 = -swing;
            }
            float sw = _439;
            float2 knee = hip + (float2(sin(sw + 0.100000001490116119384765625), -cos(sw + 0.100000001490116119384765625)) * 0.25);
            float2 foot = knee + (float2(sin(sw - (0.25 * fast::max(sw, 0.0))), -cos(sw - (0.25 * fast::max(sw, 0.0)))) * 0.25);
            float2 param_5 = q;
            float2 param_6 = hip;
            float2 param_7 = knee;
            float param_8 = 0.0280000008642673492431640625;
            float2 param_9 = q;
            float2 param_10 = knee;
            float2 param_11 = foot;
            float param_12 = 0.02199999988079071044921875;
            d = fast::min(d, fast::min(limb(param_5, param_6, param_7, param_8), limb(param_9, param_10, param_11, param_12)));
            float2 elbow = shoulder + (float2(sin((-sw) * 0.699999988079071044921875), -cos((-sw) * 0.699999988079071044921875)) * 0.2599999904632568359375);
            float2 hand = elbow + (float2(sin(((-sw) * 0.89999997615814208984375) + 0.100000001490116119384765625), -cos(((-sw) * 0.89999997615814208984375) + 0.100000001490116119384765625)) * 0.2800000011920928955078125);
            float2 param_13 = q;
            float2 param_14 = shoulder;
            float2 param_15 = elbow;
            float param_16 = 0.0199999995529651641845703125;
            float2 param_17 = q;
            float2 param_18 = elbow;
            float2 param_19 = hand;
            float param_20 = 0.01600000075995922088623046875;
            d = fast::min(d, fast::min(limb(param_13, param_14, param_15, param_16), limb(param_17, param_18, param_19, param_20)));
        }
        float soft = ((1.0 / _71.iResolution[1u]) + (0.00999999977648258209228515625 * _71.uSoftness)) / _71.uSize;
        cover = 1.0 - smoothstep(-soft, soft, d);
    }
    float3 col = mix(pic.xyz, float3(_71.uColor), float3(cover * _71.uOpacity));
    fragColor = float4(col, fast::max(pic.w, cover * _71.uOpacity));
}

fragment flair_passing_silhouette_frag_out flair_passing_silhouette_frag(constant FlairUniforms& _71 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_passing_silhouette_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _607;
    if (_71.flair_flipY > 0.5)
    {
        _607 = _71.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _607 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _607);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _71, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

