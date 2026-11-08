// flair-metal-hash: 6ce1dfe6
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float3 uFrame;
    float3 uRoom;
    packed_float3 uGlass;
    float uLag;
    float uOwnMind;
    uint uDemo;
};

struct flair_mirror_mismatch_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 demo(thread const float& t, constant FlairUniforms& _98)
{
    return (float2(_98.iResolution[0], _98.iResolution[1]) * 0.5) + float2((0.300000011920928955078125 * _98.iResolution[0u]) * sin(t * 0.699999988079071044921875), (0.20000000298023223876953125 * _98.iResolution[1u]) * sin(t * 1.10000002384185791015625));
}

static inline __attribute__((always_inline))
float2 pointerAt(thread const float& lag, thread const float2& now, constant FlairUniforms& _98)
{
    float2 at = now;
    for (int i = 0; i < 31; i++)
    {
        if (_98.iTrail[i].w < 0.5)
        {
            break;
        }
        at = _98.iTrail[i].xy;
        if ((_98.iTime - _98.iTrail[i].z) >= lag)
        {
            break;
        }
    }
    return at;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 pictureIn(thread const float2& uv, thread const float& a, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 size = float2(int2(uImage.get_width(), uImage.get_height()));
    float _174;
    if (size.x > 1.0)
    {
        _174 = size.x / size.y;
    }
    else
    {
        _174 = a;
    }
    float ia = _174;
    float2 _189;
    if (a > ia)
    {
        _189 = float2(1.0, ia / a);
    }
    else
    {
        _189 = float2(a / ia, 1.0);
    }
    float2 scale = _189;
    float3 _207;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _207 = uImage.sample(uImageSmplr, (float2(0.5) + ((uv - float2(0.5)) * scale))).xyz;
    }
    else
    {
        _207 = float3(0.5);
    }
    return _207;
}

static inline __attribute__((always_inline))
float3 leaning(thread const float2& uv, thread const float2& lean, thread const float& a, thread const float& turn, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 c = uv - float2(0.5);
    float ang = (0.0599999986588954925537109375 * lean.x) + turn;
    c = float2x2(float2(cos(ang), sin(ang)), float2(-sin(ang), cos(ang))) * c;
    float2 param = (float2(0.5) + (c / float2(1.10000002384185791015625))) + (lean * float2(-0.039999999105930328369140625, 0.02999999932944774627685546875));
    float param_1 = a;
    return pictureIn(param, param_1, uImage, uImageSmplr);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _98, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_98.iResolution[0], _98.iResolution[1]);
    float aspect = _98.iResolution[0u] / _98.iResolution[1u];
    float hover = fast::clamp(_98.iPointer.z, 0.0, 1.0);
    float2 _292;
    if (_98.uDemo != 0u)
    {
        float param = _98.iTime;
        _292 = demo(param, _98);
    }
    else
    {
        _292 = float2(_98.iResolution[0], _98.iResolution[1]) * 0.5;
    }
    float2 idle = _292;
    float2 now = mix(idle, _98.iPointer.xy, float2(hover));
    float2 _316;
    if (hover > 0.5)
    {
        float param_1 = _98.uLag;
        float2 param_2 = _98.iPointer.xy;
        _316 = pointerAt(param_1, param_2, _98);
    }
    else
    {
        float2 _332;
        if (_98.uDemo != 0u)
        {
            float param_3 = _98.iTime - _98.uLag;
            _332 = demo(param_3, _98);
        }
        else
        {
            _332 = idle;
        }
        _316 = _332;
    }
    float2 then = _316;
    float2 lean = fast::clamp(((now / float2(_98.iResolution[0], _98.iResolution[1])) - float2(0.5)) * 2.0, float2(-1.0), float2(1.0));
    float2 leanThen = fast::clamp(((then / float2(_98.iResolution[0], _98.iResolution[1])) - float2(0.5)) * 2.0, float2(-1.0), float2(1.0));
    float beat = fract(_98.iTime / 7.0);
    float2 param_4 = float2(floor(_98.iTime / 7.0), 2.0);
    float own = (smoothstep(0.550000011920928955078125, 0.60000002384185791015625, beat) * (1.0 - smoothstep(0.7799999713897705078125, 0.839999973773956298828125, beat))) * step(hash12(param_4), _98.uOwnMind);
    float3 col = _98.uRoom;
    float2 a = (uv - float2(0.039999999105930328369140625, 0.119999997317790985107421875)) / float2(0.4199999868869781494140625, 0.7599999904632568359375);
    float boxA = (aspect * 0.4199999868869781494140625) / 0.7599999904632568359375;
    bool _423 = all(a >= float2(0.0));
    bool _430;
    if (_423)
    {
        _430 = all(a <= float2(1.0));
    }
    else
    {
        _430 = _423;
    }
    if (_430)
    {
        float2 param_5 = a;
        float2 param_6 = lean;
        float param_7 = boxA;
        float param_8 = 0.0;
        col = leaning(param_5, param_6, param_7, param_8, uImage, uImageSmplr);
    }
    float2 m = (uv - float2(0.540000021457672119140625, 0.119999997317790985107421875)) / float2(0.4199999868869781494140625, 0.7599999904632568359375);
    float2 mf = ((uv - float2(0.540000021457672119140625, 0.119999997317790985107421875)) + float2(0.0199999995529651641845703125 / aspect, 0.0199999995529651641845703125)) / float2(0.4199999868869781494140625 + (0.039999999105930328369140625 / aspect), 0.800000011920928955078125);
    bool _463 = all(mf >= float2(0.0));
    bool _469;
    if (_463)
    {
        _469 = all(mf <= float2(1.0));
    }
    else
    {
        _469 = _463;
    }
    if (_469)
    {
        col = _98.uFrame * ((0.699999988079071044921875 + ((0.300000011920928955078125 * sin(mf.y * 40.0)) * 0.300000011920928955078125)) + (0.300000011920928955078125 * mf.x));
    }
    bool _490 = all(m >= float2(0.0));
    bool _496;
    if (_490)
    {
        _496 = all(m <= float2(1.0));
    }
    else
    {
        _496 = _490;
    }
    if (_496)
    {
        float2 flipped = float2(1.0 - m.x, m.y);
        float2 param_9 = flipped;
        float2 param_10 = float2(-leanThen.x, leanThen.y);
        float param_11 = boxA;
        float param_12 = own * 0.2199999988079071044921875;
        float3 refl = leaning(param_9, param_10, param_11, param_12, uImage, uImageSmplr);
        refl = mix(refl, refl * float3(_98.uGlass), float3(0.449999988079071044921875)) * 0.87999999523162841796875;
        refl += float3(0.07999999821186065673828125 * smoothstep(0.0, 0.0500000007450580596923828125, 0.0500000007450580596923828125 - abs((m.x - (m.y * 0.60000002384185791015625)) - 0.20000000298023223876953125)));
        col = refl;
    }
    fragColor = float4(col, 1.0);
}

fragment flair_mirror_mismatch_frag_out flair_mirror_mismatch_frag(constant FlairUniforms& _98 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_mirror_mismatch_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _568;
    if (_98.flair_flipY > 0.5)
    {
        _568 = _98.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _568 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _568);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _98, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

