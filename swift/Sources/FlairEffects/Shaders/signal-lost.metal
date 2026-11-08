// flair-metal-hash: 694e48de
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
    packed_float3 uTint;
    float uBlock;
    float uCorrupt;
    float uCycle;
    uint uAnimate;
    float uProgress;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_signal_lost_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _124)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_124.uBackdrop) * _124.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_124.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _124)
{
    float4 _266;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _266 = overBackdrop(param, _124);
    }
    else
    {
        float2 param_1 = fract(uv);
        _266 = float4(testCard(param_1), 1.0);
    }
    return _266;
}

static inline __attribute__((always_inline))
float4 feed(thread const float2& uv, thread const float& t, constant FlairUniforms& _124, texture2d<float> uImage, sampler uImageSmplr)
{
    float a = (6.28318023681640625 * t) / _124.uCycle;
    float2 drift = float2(0.01200000010430812835693359375 * sin(a), 0.008000000379979610443115234375 * sin((2.0 * a) + 1.0));
    float2 param = (((uv - float2(0.5)) / float2(1.059999942779541015625 + (0.0199999995529651641845703125 * sin(a)))) + float2(0.5)) + drift;
    return pictureRGBA(uImage, uImageSmplr, param, _124);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _124, texture2d<float> uImage, sampler uImageSmplr, texture2d<float> uHidden, sampler uHiddenSmplr)
{
    float2 uv = fragCoord / float2(_124.iResolution[0], _124.iResolution[1]);
    float _339;
    if (_124.uAnimate != 0u)
    {
        _339 = mod(_124.iTime, _124.uCycle);
    }
    else
    {
        _339 = _124.uProgress * _124.uCycle;
    }
    float T = _339;
    float k = T / _124.uCycle;
    float freezeAt = 0.3300000131130218505859375 * _124.uCycle;
    float _369;
    if (k < 0.2700000107288360595703125)
    {
        _369 = T;
    }
    else
    {
        float _376;
        if (k < 0.3300000131130218505859375)
        {
            _376 = floor(T * 4.0) / 4.0;
        }
        else
        {
            _376 = freezeAt;
        }
        _369 = _376;
    }
    float t = _369;
    float corrupt = (smoothstep(0.36000001430511474609375, 0.550000011920928955078125, k) * (1.0 - smoothstep(0.7599999904632568359375, 0.7799999713897705078125, k))) * _124.uCorrupt;
    float reveal = smoothstep(0.5, 0.62000000476837158203125, k) * (1.0 - smoothstep(0.7599999904632568359375, 0.7799999713897705078125, k));
    float bs = fast::max((_124.uBlock * 0.001000000047497451305389404296875) * _124.iResolution[1u], 4.0);
    float2 block = floor(fragCoord / float2(bs));
    float2 param = block + float2(0.5);
    float hb = hash12(param);
    float broken = step(hb, corrupt);
    float2 param_1 = block + float2(floor(k * 12.0));
    float2 mv = ((hash22(param_1) - float2(0.5)) * 0.07999999821186065673828125) * broken;
    float2 param_2 = uv - mv;
    float param_3 = t;
    float4 col = feed(param_2, param_3, _124, uImage, uImageSmplr);
    float3 smeared = floor(col.xyz * 5.0) / float3(5.0);
    float4 _467 = col;
    float3 _472 = mix(_467.xyz, smeared, float3(broken));
    col.x = _472.x;
    col.y = _472.y;
    col.z = _472.z;
    float2 param_4 = (block * 1.7000000476837158203125) + float2(3.0);
    float shows = (broken * step(0.449999988079071044921875, hash12(param_4))) * reveal;
    float2 param_5 = float2(floor(_124.iTime * 2.0), 4.0);
    float2 param_6 = uv + ((hash22(param_5) - float2(0.5)) * 0.0040000001899898052215576171875);
    float4 hidden = pictureRGBA(uHidden, uHiddenSmplr, param_6, _124);
    float hl = smoothstep(0.1500000059604644775390625, 0.699999988079071044921875, dot(hidden.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)));
    float3 ghost = (float3(_124.uTint) * hl) * (0.85000002384185791015625 + (0.1500000059604644775390625 * sin(_124.iTime * 9.0)));
    float4 _534 = col;
    float3 _539 = mix(_534.xyz, ghost, float3(shows));
    col.x = _539.x;
    col.y = _539.y;
    col.z = _539.z;
    float row = floor(fragCoord.y / bs);
    float4 _552 = col;
    float4 _554 = col;
    float2 param_7 = float2(row, floor(k * 30.0));
    float3 _568 = mix(_552.xyz, _554.yzx, float3(broken * step(0.920000016689300537109375, hash12(param_7))));
    col.x = _568.x;
    col.y = _568.y;
    col.z = _568.z;
    float snowAmount = smoothstep(0.7599999904632568359375, 0.7799999713897705078125, k) * (1.0 - smoothstep(0.89999997615814208984375, 1.0, k));
    float2 param_8 = fragCoord + float2(floor(_124.iTime * 30.0) * 13.0);
    float snow = hash12(param_8);
    float4 _595 = col;
    float3 _605 = mix(_595.xyz, float3((snow * 0.800000011920928955078125) + 0.100000001490116119384765625), float3(snowAmount));
    col.x = _605.x;
    col.y = _605.y;
    col.z = _605.z;
    float4 _621 = col;
    float3 _623 = _621.xyz * (0.949999988079071044921875 + (0.0500000007450580596923828125 * sin(fragCoord.y * 3.141590118408203125)));
    col.x = _623.x;
    col.y = _623.y;
    col.z = _623.z;
    fragColor = float4(fast::clamp(col.xyz, float3(0.0), float3(1.0)), fast::max(col.w, snowAmount));
}

fragment flair_signal_lost_frag_out flair_signal_lost_frag(constant FlairUniforms& _124 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uHidden [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uHiddenSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_signal_lost_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _656;
    if (_124.flair_flipY > 0.5)
    {
        _656 = _124.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _656 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _656);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _124, uImage, uImageSmplr, uHidden, uHiddenSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

